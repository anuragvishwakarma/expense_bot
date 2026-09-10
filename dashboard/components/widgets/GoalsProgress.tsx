export default function GoalsProgress({
  goals,
}: {
  goals: Array<{ name: string; target: number; saved: number }>
>) {
  return (
    <div className="space-y-4">
      {goals.map((goal, idx) => (
        <div key={idx} className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-2">
            {goal.name}
          </h3>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className={`bg-blue-500 h-2.5 rounded-full`}
              style={{ width: `${Math.min((goal.saved / goal.target) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span>Saved: ₹{goal.saved.toFixed(2)}</span>
            <span>Target: ₹{goal.target.toFixed(2)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}