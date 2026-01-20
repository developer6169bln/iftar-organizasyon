-- Add assignedTo column to tasks table
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "assignedTo" TEXT;

-- Add foreign key constraint
ALTER TABLE "tasks" 
ADD CONSTRAINT IF NOT EXISTS "tasks_assignedTo_fkey" 
FOREIGN KEY ("assignedTo") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS "tasks_assignedTo_idx" ON "tasks"("assignedTo");
