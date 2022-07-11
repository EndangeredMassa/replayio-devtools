/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

//
import React, { Component } from "react";
import { connect } from "react-redux";
import fuzzyAldrin from "fuzzaldrin-plus";
import { basename } from "../utils/path";
import debounce from "lodash/debounce";
import actions from "../actions";
import {
  getQuickOpenEnabled,
  getQuickOpenQuery,
  getQuickOpenType,
  getQuickOpenProject,
  getSourceContent,
  getSymbols,
  getTabs,
  isSymbolsLoading,
  getContext,
} from "../selectors";
import { setViewMode } from "ui/actions/layout";
import { getViewMode } from "ui/reducers/layout";
import { memoizeLast } from "../utils/memoizeLast";
import { scrollList } from "../utils/result-list";
import {
  formatSymbols,
  parseLineColumn,
  formatShortcutResults,
  formatSources,
} from "../utils/quick-open";
import Modal from "./shared/Modal";
import SearchInput from "./shared/SearchInput";
import ResultList from "./shared/ResultList";
import { trackEvent } from "ui/utils/telemetry";
import { getGlobalFunctions, isGlobalFunctionsLoading } from "../reducers/ast";
import {
  getAllSourceDetails,
  getSelectedSourceDetails,
  getSourcesLoading,
  sourceSelectors,
} from "ui/reducers/sources";

const maxResults = 100;

const SIZE_BIG = { size: "big" };
const SIZE_DEFAULT = {};

function filter(values, query) {
  const preparedQuery = fuzzyAldrin.prepareQuery(query);

  return fuzzyAldrin.filter(values, query, {
    key: "value",
    maxResults,
    preparedQuery,
  });
}

export class QuickOpenModal extends Component {
  constructor(props) {
    super(props);
    this.state = { results: null, selectedIndex: 0 };
  }

  setResults(results) {
    if (results) {
      results = results.slice(0, maxResults);
    }
    this.setState({ results });
  }

  componentDidUpdate(prevProps) {
    const hasChanged = field => prevProps[field] !== this.props[field];

    if (this.refs.resultList && this.refs.resultList.refs) {
      scrollList(this.refs.resultList.refs, this.state.selectedIndex);
    }

    if (hasChanged("sourceCount")) {
      // If the source count has changed, we need to update the throttled
      // updateResults callback with the appropriate throttle duration.
      this.updateResults = this.getUpdateResultsCallback();
    }

    if (
      hasChanged("enabled") ||
      hasChanged("query") ||
      hasChanged("symbols") ||
      hasChanged("globalFunctions")
    ) {
      this.updateResults(this.props.query);
    }
  }

  closeModal = () => {
    this.props.closeQuickOpen();
  };

  dropGoto = query => {
    const index = query.indexOf(":");
    return index !== -1 ? query.slice(0, index) : query;
  };

  formatSources = memoizeLast((sourceList, tabs) => {
    const tabUrls = new Set(tabs.map(tab => tab.url));
    return formatSources(sourceList, tabUrls);
  });

  searchSources = query => {
    const { sourceList, tabs, sourcesLoading } = this.props;

    if (sourcesLoading) {
      return null;
    }

    const sources = this.formatSources(sourceList, tabs);
    const results = query == "" ? sources : filter(sources, this.dropGoto(query));
    return this.setResults(results);
  };

  getFunctions() {
    const { project, symbols, globalFunctions } = this.props;

    return project ? globalFunctions : symbols.functions;
  }

  searchFunctions(query) {
    let fns = this.getFunctions();

    if (query === "@" || query === "#") {
      return this.setResults(fns);
    }
    fns = filter(fns, query.slice(1));
    return this.setResults(fns);
  }

  searchShortcuts = query => {
    const results = formatShortcutResults();
    if (query == "?") {
      this.setResults(results);
    } else {
      this.setResults(filter(results, query.slice(1)));
    }
  };

  showTopSources = () => {
    const { sourceList, tabs } = this.props;
    const tabUrls = new Set(tabs.map(tab => tab.url));

    if (tabs.length > 0) {
      this.setResults(
        formatSources(
          sourceList.filter(source => !!source.url && tabUrls.has(source.url)),
          tabUrls
        )
      );
    } else {
      this.setResults(formatSources(sourceList, tabUrls));
    }
  };

  getDebounceMs = () => {
    const { sourceCount } = this.props;
    const ms = sourceCount > 1000 ? 1000 : 200;

    return ms;
  };

  getUpdateResultsCallback = () =>
    debounce(query => {
      if (this.isGotoQuery()) {
        return;
      }

      if (query == "" && !this.isShortcutQuery()) {
        return this.showTopSources();
      }

      if (this.isFunctionQuery()) {
        return this.searchFunctions(query);
      }

      if (this.isShortcutQuery()) {
        return this.searchShortcuts(query);
      }

      return this.searchSources(query);
    }, this.getDebounceMs());

  updateResults = this.getUpdateResultsCallback();

  setModifier = item => {
    if (["@", "#", ":"].includes(item.id)) {
      this.props.setQuickOpenQuery(item.id);
    }
  };

  selectResultItem = (e, item) => {
    if (item == null) {
      return;
    }

    if (this.isShortcutQuery()) {
      return this.setModifier(item);
    }

    if (this.isGotoSourceQuery()) {
      trackEvent("quick_open.select_line");

      const location = parseLineColumn(this.props.query);
      return this.gotoLocation({ ...location, sourceId: item.id });
    }

    if (this.isFunctionQuery()) {
      const start = item.location?.start;
      trackEvent("quick_open.select_function");

      return this.gotoLocation({
        line: start?.line || 0,
        sourceId: start?.sourceId,
      });
    }

    trackEvent("quick_open.select_source");
    this.gotoLocation({ sourceId: item.id, line: 0 });
  };

  onSelectResultItem = item => {
    const { selectedSource, highlightLineRange, project } = this.props;

    if (selectedSource == null || !this.isFunctionQuery()) {
      return;
    }

    if (this.isFunctionQuery() && !project) {
      return highlightLineRange({
        ...(item.location != null
          ? { end: item.location.end.line, start: item.location.start.line }
          : {}),
        sourceId: selectedSource.id,
      });
    }
  };

  traverseResults = e => {
    const direction = e.key === "ArrowUp" ? -1 : 1;
    const { selectedIndex, results } = this.state;
    const resultCount = this.getResultCount();
    const index = selectedIndex + direction;
    const nextIndex = (index + resultCount) % resultCount || 0;

    this.setState({ selectedIndex: nextIndex });

    if (results != null) {
      this.onSelectResultItem(results[nextIndex]);
    }
  };

  gotoLocation = location => {
    const { cx, selectSpecificLocation, selectedSource, viewMode, setViewMode } = this.props;

    if (location != null) {
      const selectedSourceId = selectedSource ? selectedSource.id : "";
      const sourceId = location.sourceId ? location.sourceId : selectedSourceId;
      selectSpecificLocation(cx, {
        column: location.column,
        line: location.line,
        sourceId,
      });

      if (viewMode === "non-dev") {
        setViewMode("dev");
      }
      this.closeModal();
    }
  };

  onChange = e => {
    const { selectedSource, selectedContentLoaded, setQuickOpenQuery } = this.props;
    setQuickOpenQuery(e.target.value);
    const noSource = !selectedSource || !selectedContentLoaded;
    if ((noSource && this.isFunctionQuery()) || this.isGotoQuery()) {
      return;
    }

    this.updateResults(e.target.value);
  };

  onKeyDown = e => {
    const { enabled, query } = this.props;
    const { selectedIndex } = this.state;
    const isGoToQuery = this.isGotoQuery();
    const results = this.state.results;

    if ((!enabled || !results) && !isGoToQuery) {
      return;
    }

    if (e.key === "Enter") {
      if (isGoToQuery) {
        const location = parseLineColumn(query);
        return this.gotoLocation(location);
      }

      if (results) {
        return this.selectResultItem(e, results[selectedIndex]);
      }
    }

    if (e.key === "Tab") {
      return this.closeModal();
    }

    if (["ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
      return this.traverseResults(e);
    }
  };

  getResultCount = () => {
    const results = this.state.results;

    return results && results.length ? results.length : 0;
  };

  // Query helpers
  isFunctionQuery = () => this.props.searchType === "functions";
  isGotoQuery = () => this.props.searchType === "goto";
  isGotoSourceQuery = () => this.props.searchType === "gotoSource";
  isShortcutQuery = () => this.props.searchType === "shortcuts";
  isSourcesQuery = () => this.props.searchType === "sources";
  isSourceSearch = () => this.isSourcesQuery() || this.isGotoSourceQuery();

  /* eslint-disable react/no-danger */
  renderHighlight(candidateString, query) {
    const options = {
      wrap: {
        tagClose: "</mark>",
        tagOpen: '<mark class="highlight">',
      },
    };

    // There might be a match in the path but not the title.
    // In this case just render the whole title, un-styled.
    //
    // Note that "fuzzaldrin-plus" returns an HTML string usually,
    // but if either the input string or the query string are empty, it returns an array.
    const html = query ? fuzzyAldrin.wrap(candidateString, query, options) : candidateString;

    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  }

  highlightMatching = (query, results) => {
    let newQuery = query;
    if (newQuery === "") {
      return results;
    }
    newQuery = query.replace(/[@:#?]/gi, " ");

    return results.map(result => {
      if (typeof result.title == "string") {
        return {
          ...result,
          title: this.renderHighlight(result.title, basename(newQuery), "title"),
        };
      }
      return result;
    });
  };

  shouldShowErrorEmoji() {
    const { query } = this.props;
    if (this.isGotoQuery()) {
      return !/^:\d*$/.test(query);
    }
    return !!query && !this.getResultCount();
  }

  getSummaryMessage() {
    const { symbolsLoading, project, globalFunctionsLoading } = this.props;

    if (this.isGotoQuery()) {
      return "Go to line";
    }

    if (project && globalFunctionsLoading) {
      return `Loading functions`;
    }

    if (this.isFunctionQuery() && symbolsLoading) {
      return "Loading\u2026";
    }

    return "";
  }

  render() {
    const { enabled, query } = this.props;
    const { selectedIndex, results } = this.state;

    if (!enabled) {
      return null;
    }

    const items = this.highlightMatching(query, results || []);
    const expanded = !!items && items.length > 0;
    const showLoadingResults = query?.replace(/@/g, "") && results === null;

    return (
      <Modal
        width="500px"
        additionalClass={"rounded-lg text-xs"}
        in={enabled}
        handleClose={this.closeModal}
      >
        <SearchInput
          query={query}
          hasPrefix={true}
          count={this.getResultCount()}
          placeholder={"Go to file…"}
          summaryMsg={this.getSummaryMessage()}
          showErrorEmoji={this.shouldShowErrorEmoji()}
          isLoading={false}
          onChange={this.onChange}
          onKeyDown={this.onKeyDown}
          handleClose={this.closeModal}
          expanded={expanded}
          showClose={false}
          selectedItemId={expanded && items[selectedIndex] ? items[selectedIndex].id : ""}
          size="big"
        />
        {showLoadingResults ? <div className="px-2 py-1">Loading results…</div> : null}
        {results && items && (
          <ResultList
            key="results"
            items={items}
            selected={selectedIndex}
            selectItem={this.selectResultItem}
            ref="resultList"
            expanded={expanded}
            {...(this.isSourceSearch() ? SIZE_BIG : SIZE_DEFAULT)}
          />
        )}
      </Modal>
    );
  }
}

function mapStateToProps(state) {
  const selectedSource = getSelectedSourceDetails(state);
  const tabs = getTabs(state);

  return {
    cx: getContext(state),
    displayedSources: getAllSourceDetails(state),
    enabled: getQuickOpenEnabled(state),
    globalFunctions: getGlobalFunctions(state) || [],
    globalFunctionsLoading: isGlobalFunctionsLoading(state),
    project: getQuickOpenProject(state),
    query: getQuickOpenQuery(state),
    searchType: getQuickOpenType(state),
    selectedContentLoaded: selectedSource
      ? !!getSourceContent(state, selectedSource.id)
      : undefined,
    selectedSource,
    sourceCount: sourceSelectors.selectTotal(state.experimentalSources.sources).length,
    sourceList: getAllSourceDetails(state),
    sourcesLoading: getSourcesLoading(state),
    symbols: formatSymbols(getSymbols(state, selectedSource)),
    symbolsLoading: isSymbolsLoading(state, selectedSource),
    tabs,
    viewMode: getViewMode(state),
  };
}

export default connect(mapStateToProps, {
  closeQuickOpen: actions.closeQuickOpen,
  highlightLineRange: actions.highlightLineRange,
  selectSpecificLocation: actions.selectSpecificLocation,
  setQuickOpenQuery: actions.setQuickOpenQuery,
  setViewMode,
})(QuickOpenModal);
