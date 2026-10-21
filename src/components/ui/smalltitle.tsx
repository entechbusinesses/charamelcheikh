export default function SmallTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-5 mb-3">
      <h1 className=" text-main">{title}:</h1>
      <div className="flex-grow h-0.5 rounded-full bg-main"></div>
    </div>
  );
}
