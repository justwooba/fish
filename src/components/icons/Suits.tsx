"use client";

export function SuitSpade({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C12 2 4 10 4 14.5C4 17.5 6 19 8.5 19C10 19 11.2 18.2 12 17C12.8 18.2 14 19 15.5 19C18 19 20 17.5 20 14.5C20 10 12 2 12 2ZM10 20C10 20 10.5 22 12 22C13.5 22 14 20 14 20H10Z" />
    </svg>
  );
}

export function SuitHeart({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.27 2 8.5C2 5.41 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.08C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.41 22 8.5C22 12.27 18.6 15.36 13.45 20.03L12 21.35Z" />
    </svg>
  );
}

export function SuitDiamond({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2L22 12L12 22L2 12L12 2Z" />
    </svg>
  );
}

export function SuitClub({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C9.24 2 7 4.24 7 7C7 8.8 7.9 10.37 9.25 11.25C7.37 11.5 6 13.06 6 15C6 17.21 7.79 19 10 19H10.5C10.18 19.93 10 20.94 10 22H14C14 20.94 13.82 19.93 13.5 19H14C16.21 19 18 17.21 18 15C18 13.06 16.63 11.5 14.75 11.25C16.1 10.37 17 8.8 17 7C17 4.24 14.76 2 12 2Z" />
    </svg>
  );
}