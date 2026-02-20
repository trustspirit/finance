export default function StatCard({
  label,
  value,
  color = "gray",
  icon,
}: {
  label: string;
  value: string;
  color?: string;
  icon?: React.ReactNode;
}) {
  const colors: Record<string, string> = {
    gray: "bg-white",
    yellow: "bg-yellow-50 border-yellow-200",
    green: "bg-green-50 border-green-200",
    blue: "bg-blue-50 border-blue-200",
    red: "bg-red-50 border-red-200",
  };
  return (
    <div className={`rounded-lg shadow border p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-xs text-gray-500">{label}</p>
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
