interface PillProps {
  options: string[];
  active: string;
  onSelect: (option: string) => void;
}

export function Pill({ options, active, onSelect }: PillProps) {
  return (
    <div className="flex overflow-hidden rounded-control border-[1.5px] border-border text-[10.5px] font-semibold">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onSelect(option)}
          className={
            option === active
              ? "bg-sage-600 px-3 py-1.5 text-white"
              : "px-3 py-1.5 text-stone"
          }
        >
          {option}
        </button>
      ))}
    </div>
  );
}
