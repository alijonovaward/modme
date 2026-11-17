import { Button, Input, Label, Modal } from "./ui";
import type { DateRange } from "../hooks/useDateRangeFilter";

export function DateRangeFilterModal({
  title = "Sana oralig'i",
  isOpen,
  draft,
  onChangeDraft,
  onApply,
  onClear,
  onClose,
}: {
  title?: string;
  isOpen: boolean;
  draft: DateRange;
  onChangeDraft: (next: DateRange) => void;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  if (!isOpen) return null;
  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Dan</Label>
            <Input
              type="date"
              value={draft.dateFrom}
              onChange={(e) => onChangeDraft({ ...draft, dateFrom: e.target.value })}
            />
          </div>
          <div>
            <Label>Gacha</Label>
            <Input
              type="date"
              value={draft.dateTo}
              onChange={(e) => onChangeDraft({ ...draft, dateTo: e.target.value })}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={onApply}>
            Qo'llash
          </Button>
          <Button variant="secondary" onClick={onClear}>
            Shu oyga qaytarish
          </Button>
        </div>
      </div>
    </Modal>
  );
}
