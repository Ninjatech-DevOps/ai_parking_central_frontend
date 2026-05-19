import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronDown, Check } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface SearchSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
}

export default function SearchSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  className = "",
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedLabel = options.find((o) => o.value === value)?.label || placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          className={`flex items-center justify-between gap-2 h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer ${className}`}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown size={12} className="text-slate-400 shrink-0" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0 rounded-xl" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="text-[12px] h-9" />
          <CommandList className="max-h-56">
            <CommandEmpty className="text-[12px] text-slate-400 py-4 text-center">No results</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.label}
                  onSelect={() => { onValueChange(o.value); setOpen(false); }}
                  className="text-[12px] rounded-lg"
                >
                  <span className="flex-1">{o.label}</span>
                  {value === o.value && <Check size={12} className="text-teal-600" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
