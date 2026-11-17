import { useState } from "react";
import { currentMonthRange } from "../utils/date";

export interface DateRange {
  dateFrom: string;
  dateTo: string;
}

export function useDateRangeFilter(onApply: (range: DateRange) => void) {
  const [filters, setFilters] = useState<DateRange>(() => currentMonthRange());
  const [draft, setDraft] = useState<DateRange>(filters);
  const [isOpen, setIsOpen] = useState(false);

  const open = () => {
    setDraft(filters);
    setIsOpen(true);
  };

  const apply = () => {
    setFilters(draft);
    setIsOpen(false);
    onApply(draft);
  };

  const clear = () => {
    const defaults = currentMonthRange();
    setDraft(defaults);
    setFilters(defaults);
    setIsOpen(false);
    onApply(defaults);
  };

  return {
    filters,
    draft,
    setDraft,
    isOpen,
    open,
    apply,
    clear,
    close: () => setIsOpen(false),
  };
}
