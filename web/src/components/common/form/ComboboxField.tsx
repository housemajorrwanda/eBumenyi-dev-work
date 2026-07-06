import { FC, Fragment, useEffect, useRef, useState } from "react";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Transition,
} from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";

export interface IOptionFieldOption {
  value: string;
  label: string;
}

interface IOptionsField {
  label?: string;
  error?: string;
  options: IOptionFieldOption[];
  margin?: boolean;
  disabled?: boolean;
  hideQueryOnChange?: boolean;
  creatable?: boolean;
  createLabel?: (query: string) => string;
  defaultValue?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onCreate?: (query: string) => void;
  onSearch?: (query: string) => void;
}

const ComboboxField: FC<IOptionsField> = ({
  label,
  options,
  error,
  defaultValue,
  margin = true,
  hideQueryOnChange = false,
  onChange,
  disabled,
  creatable = false,
  createLabel,
  onCreate,
  placeholder,
  onSearch,
}) => {
  const [selected, setSelected] = useState<IOptionFieldOption | null>(null);
  const [query, setQuery] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const valueChanged = (value: IOptionFieldOption | null) => {
    if (value == null) {
      setSelected(null);
      if (onChange) {
        onChange("");
      }
    } else {
      if (value.value === "__create__" && creatable && onCreate) {
        onCreate(query);
        if (hideQueryOnChange) {
          setQuery("");
        }
        return;
      }
      setSelected(options.find((option) => option.value == value.value) || null);
      if (onChange) {
        onChange(value.value);
      }
      if (hideQueryOnChange) {
        setQuery("");
      }
    }
  };

  useEffect(() => {
    if (!onSearch) return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      onSearch(query);
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [query, onSearch]);

  const filteredPeople = onSearch
    ? options
    : query === ""
      ? options
      : options.filter((option: IOptionFieldOption) => {
          const searchQuery = query.toLowerCase().trim();
          const optionLabel = option.label.toLowerCase();
          
          // Exact match (highest priority)
          if (optionLabel === searchQuery) {
            return true;
          }
          
          // Starts with match (high priority)
          if (optionLabel.startsWith(searchQuery)) {
            return true;
          }
          
          // Word boundary match (medium priority)
          const words = optionLabel.split(/\s+/);
          if (words.some(word => word.startsWith(searchQuery))) {
            return true;
          }
          
          // Contains match (lower priority)
          if (optionLabel.includes(searchQuery)) {
            return true;
          }
          
          // Fuzzy match for typos (lowest priority)
          const cleanOption = optionLabel.replace(/\s+/g, "");
          const cleanQuery = searchQuery.replace(/\s+/g, "");
          if (cleanOption.includes(cleanQuery)) {
            return true;
          }
          
          return false;
        })
        .sort((a, b) => {
          const searchQuery = query.toLowerCase().trim();
          const aLabel = a.label.toLowerCase();
          const bLabel = b.label.toLowerCase();
          
          // Prioritize exact matches
          if (aLabel === searchQuery && bLabel !== searchQuery) return -1;
          if (bLabel === searchQuery && aLabel !== searchQuery) return 1;
          
          // Prioritize starts with matches
          const aStartsWith = aLabel.startsWith(searchQuery);
          const bStartsWith = bLabel.startsWith(searchQuery);
          if (aStartsWith && !bStartsWith) return -1;
          if (bStartsWith && !aStartsWith) return 1;
          
          // Prioritize word boundary matches
          const aWords = aLabel.split(/\s+/);
          const bWords = bLabel.split(/\s+/);
          const aWordMatch = aWords.some(word => word.startsWith(searchQuery));
          const bWordMatch = bWords.some(word => word.startsWith(searchQuery));
          if (aWordMatch && !bWordMatch) return -1;
          if (bWordMatch && !aWordMatch) return 1;
          
          // Default alphabetical sorting
          return aLabel.localeCompare(bLabel);
        });

  useEffect(() => {
    if (!defaultValue) {
      setSelected(null);
      return;
    }
    if (options.length > 0) {
      const defaultOption = options.find((option) => option.value === defaultValue);
      if (defaultOption && selected?.value !== defaultOption.value) {
        setSelected(defaultOption);
      }
    }
  }, [defaultValue, options, selected?.value]);

  return (
    <div className='block w-full'>
      {label && (
        <label className='block capitalize text-sm font-medium leading-6 text-gray-500'>
          {label}
        </label>
      )}
      <div className={`${margin ? "mt-1" : ""} w-full`}>
        <Combobox value={selected} onChange={valueChanged}>
          <div className='relative'>
            <div
              className={`relative w-full cursor-default overflow-hidden rounded-lg bg-white text-left ${
                !disabled ? "ring-1 rig-inset" : ""
              } focus:outline-none focus-visible:ring-1 ${
                error
                  ? `focus-visible:ring-red-500 focus-visible:ring-inset-green ring-red-300`
                  : `focus-visible:ring-darkblue ring-gray-200`
              } sm:text-sm relative w-full cursor-default overflow-hidden rounded-lg bg-white text-left  focus:outline-none focus-visible:ring-2 focus-visible:ring-white/75 focus-visible:ring-offset-2 focus-visible:ring-offset-teal-300 sm:text-sm`}
            >
              <ComboboxInput
                className='w-full border-none py-3 pl-1.5 pr-10 text-sm leading-5 text-gray-900 focus:ring-0 focus:outline-none disabled:bg-white'
                displayValue={(option: IOptionFieldOption) =>
                  hideQueryOnChange ? "" : option?.label
                }
                disabled={disabled}
                placeholder={placeholder}
                onChange={(event) => setQuery(event.target.value)}
              />
              {!disabled && (
                <ComboboxButton className='absolute inset-y-0 right-0 flex items-center pr-2'>
                  <ChevronUpDownIcon
                    className='h-5 w-5 text-gray-400'
                    aria-hidden='true'
                  />
                </ComboboxButton>
              )}
            </div>
            <Transition
              as={Fragment}
              leave='transition ease-in duration-100'
              leaveFrom='opacity-100'
              leaveTo='opacity-0'
              afterLeave={() => setQuery("")}
            >
              <ComboboxOptions
                className={`absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base ${
                  !disabled ? "shadow-sm ring-1 ring-black/5 focus:outline-none" : ""
                } sm:text-sm`}
                style={{ position: "absolute", top: "100%", left: 0, zIndex: 10 }}
              >
                {filteredPeople.length === 0 && query !== "" ? (
                  creatable ? (
                    <ComboboxOption
                      key='__create__'
                      className={({ active }) =>
                        `relative cursor-default select-none py-2 pl-10 pr-4 ${
                          active ? "bg-blue-600 text-white" : "text-gray-900"
                        }`
                      }
                      value={{ value: "__create__", label: query }}
                    >
                      {({ selected }) => (
                        <>
                          <span
                            title={query}
                            className={`block truncate ${
                              selected ? "font-medium" : "font-normal"
                            }`}
                          >
                            {createLabel ? createLabel(query) : `Create "${query}"`}
                          </span>
                        </>
                      )}
                    </ComboboxOption>
                  ) : (
                    <div className='relative cursor-default select-none px-4 py-2 text-gray-700'>
                      Nothing found.
                    </div>
                  )
                ) : (
                  filteredPeople.slice(0, 30).map((option: IOptionFieldOption) => (
                    <ComboboxOption
                      key={option.value}
                      className={({ active }) =>
                        `relative cursor-default select-none py-2 pl-10 pr-4 ${
                          active ? "bg-blue-600 text-white" : "text-gray-900"
                        }`
                      }
                      value={option}
                    >
                      {({ selected, active }) => (
                        <>
                          <span
                            title={option.label}
                            className={`block truncate ${
                              selected ? "font-medium" : "font-normal"
                            }`}
                          >
                            {option.label}
                          </span>
                          {selected ? (
                            <span
                              className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                                active ? "text-white" : "text-darkblue"
                              }`}
                            >
                              <CheckIcon className='h-5 w-5' aria-hidden='true' />
                            </span>
                          ) : null}
                        </>
                      )}
                    </ComboboxOption>
                  ))
                )}
              </ComboboxOptions>
            </Transition>
          </div>
        </Combobox>
        <label className='block text-sm leading-6 text-red-500'>{error}</label>
      </div>
    </div>
  );
};

export default ComboboxField;
