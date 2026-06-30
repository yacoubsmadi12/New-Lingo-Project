export function Loader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        <div className="absolute inset-4 rounded-full border-4 border-secondary/20"></div>
        <div className="absolute inset-4 rounded-full border-4 border-secondary border-b-transparent animate-spin direction-reverse"></div>
      </div>
    </div>
  );
}
