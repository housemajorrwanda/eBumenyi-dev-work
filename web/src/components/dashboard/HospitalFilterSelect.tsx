import React, { useEffect, useRef, useState } from "react";
import {
  CloseButton,
  Popover,
  PopoverButton,
  PopoverPanel,
} from "@headlessui/react";
import { usePopper } from "react-popper";
import { Building2, Check, ChevronDown, Search } from "lucide-react";
import { IOptionFieldOption } from "@/components/common/form/ComboboxField";

const TRIGGER_CLS =
  "flex items-center gap-1 text-xs border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#3363AD] bg-white transition-colors min-w-[110px] max-w-[220px]";

interface HospitalFilterSelectProps {
  value: string;
  options: IOptionFieldOption[];
  onChange: (value: string) => void;
  onSearch: (query: string) => void;
}

export const HospitalFilterSelect: React.FC<HospitalFilterSelectProps> = ({
  value,
  options,
  onChange,
  onSearch,
}) => {
  const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: "bottom-start",
    modifiers: [
      {
        name: "offset",
        options: { offset: [0, 6] },
      },
      {
        name: "preventOverflow",
        options: { padding: 8 },
      },
    ],
  });

  useEffect(() => {
    if (!value) {
      setSelectedLabel("");
      return;
    }
    const match = options.find((option) => option.value === value);
    if (match) setSelectedLabel(match.label);
  }, [value, options]);

  useEffect(() => {
    const timer = setTimeout(() => onSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, onSearch]);

  const isActive = value !== "";
  const displayText = isActive ? selectedLabel || "Selected hospital" : "Hospital";

  return (
    <Popover className="relative">
      <PopoverButton
        ref={setReferenceElement}
        onClick={() => setSearchQuery("")}
        className={`${TRIGGER_CLS} ${
          isActive
            ? "border-[#3363AD] text-[#3363AD] font-medium"
            : "border-gray-200 text-gray-600"
        }`}
        title={isActive ? selectedLabel : "Filter by hospital"}
      >
        <Building2 size={12} className="shrink-0" />
        <span className="truncate">{displayText}</span>
        <ChevronDown size={12} className="shrink-0 text-gray-400" />
      </PopoverButton>

      <PopoverPanel
        ref={setPopperElement}
        style={styles.popper}
        {...attributes.popper}
        className="fixed z-[100] w-80 rounded-lg border border-gray-200 bg-white shadow-lg"
        onFocus={() => searchInputRef.current?.focus()}
      >
        <div className="border-b border-gray-100 px-3 py-2.5">
          <p className="text-xs font-medium text-gray-700">Filter by hospital</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Search and select a facility to narrow dashboard data.
          </p>
        </div>

        <div className="border-b border-gray-100 p-2">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              ref={searchInputRef}
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search hospitals..."
              className="w-full rounded-md border border-gray-200 py-1.5 pl-8 pr-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#3363AD] focus:outline-none focus:ring-1 focus:ring-[#3363AD]"
            />
          </div>
        </div>

        <div className="max-h-56 overflow-y-auto py-1">
          <CloseButton
            as="button"
            type="button"
            onClick={() => onChange("")}
            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
              !isActive ? "bg-[#3363AD]/5 font-medium text-[#3363AD]" : "text-gray-600"
            }`}
          >
            <span>All hospitals</span>
            {!isActive ? <Check size={14} /> : null}
          </CloseButton>

          {options.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-gray-500">
              {searchQuery.trim()
                ? "No hospitals match your search."
                : "Start typing to find hospitals."}
            </p>
          ) : (
            options.map((option) => {
              const selected = value === option.value;
              return (
                <CloseButton
                  key={option.value}
                  as="button"
                  type="button"
                  onClick={() => {
                    setSelectedLabel(option.label);
                    onChange(option.value);
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
                    selected
                      ? "bg-[#3363AD]/5 font-medium text-[#3363AD]"
                      : "text-gray-700"
                  }`}
                  title={option.label}
                >
                  <span className="truncate">{option.label}</span>
                  {selected ? <Check size={14} className="shrink-0" /> : null}
                </CloseButton>
              );
            })
          )}
        </div>
      </PopoverPanel>
    </Popover>
  );
};
