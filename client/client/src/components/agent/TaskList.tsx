
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const TaskList = ({ tasks }) => {
  if (!tasks?.length) return null;
  return (
    <div className="mt-6 space-y-4">
      <h2 className="text-xl font-bold">📌 Recommended Task List</h2>
      {tasks.map((task, index) => (
        <Card key={task.id} className="p-4 shadow-sm border">
          <h3 className="text-lg font-semibold">
            {index + 1}. {task.title}
          </h3>
          {task.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {task.description}
            </p>
          )}
          <Badge className="mt-2">{task.phase}</Badge>
        </Card>
      ))}
    </div>
  );
};
