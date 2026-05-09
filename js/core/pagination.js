function getTotalPages(totalItems, pageSize) {
  if (totalItems <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(totalItems / pageSize));
}

export function createPaginationState(totalItems = 0, pageSize = Math.max(totalItems, 1)) {
  return {
    currentPage: 1,
    pageSize: Math.max(pageSize, 1),
    totalPages: getTotalPages(totalItems, Math.max(pageSize, 1))
  };
}

export function resetPagination(currentState, totalItems = 0, pageSize = currentState?.pageSize ?? 1) {
  return createPaginationState(totalItems, pageSize);
}

export function nextPage(state) {
  return {
    ...state,
    currentPage: Math.min(state.currentPage + 1, state.totalPages)
  };
}

export function previousPage(state) {
  return {
    ...state,
    currentPage: Math.max(state.currentPage - 1, 1)
  };
}
