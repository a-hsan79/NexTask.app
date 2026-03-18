-- Add delivery_link to freelance_orders
ALTER TABLE freelance_orders ADD COLUMN IF NOT EXISTS delivery_link TEXT;

-- Add result_link to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS result_link TEXT;
