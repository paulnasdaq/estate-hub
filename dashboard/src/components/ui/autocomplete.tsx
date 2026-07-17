import { useId, useState } from "react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

// `label` is what identifies the item (and what the parent typically echoes
// into the input on select); `description` is optional secondary text shown
// muted alongside it in the dropdown (e.g. a price) without affecting selection.
export type AutocompleteItem = {
  id: string;
  label: string;
  description?: string;
};

// A minimal typeahead: a text input backed by an absolutely-positioned list of
// suggestions. It is fully controlled — the parent owns the query text (to feed
// a debounced search) and the item list, and is told when an item is picked.
// Selection state (the chosen id) also lives with the parent; this component
// only renders and reports interactions.
export function Autocomplete({
  items,
  query,
  onQueryChange,
  onSelect,
  ariaLabel,
  placeholder,
  disabled = false,
  loading = false,
  emptyText = "No matches",
  ariaInvalid = false,
}: {
  items: AutocompleteItem[];
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (item: AutocompleteItem) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  emptyText?: string;
  ariaInvalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const listboxId = useId();
  const showList = open && !disabled;

  return (
    <div className="relative">
      <Input
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-invalid={ariaInvalid}
        autoComplete="off"
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => {
          onQueryChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Closing on blur would race the option click; options preventDefault on
        // mousedown so focus (and this list) survive until the click lands.
        onBlur={() => setOpen(false)}
      />

      {showList && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md"
        >
          {loading ? (
            <li className="px-2 py-1.5 text-muted-foreground">Loading…</li>
          ) : items.length === 0 ? (
            <li className="px-2 py-1.5 text-muted-foreground">{emptyText}</li>
          ) : (
            items.map((item) => (
              <li
                key={item.id}
                role="option"
                aria-selected={false}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect(item);
                  setOpen(false);
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5",
                  "hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <span className="truncate">{item.label}</span>
                {item.description && (
                  <span className="ml-auto shrink-0 text-muted-foreground">
                    {item.description}
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
