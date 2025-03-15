-- Create signal queue table (simplified version)
create table if not exists signal_queue (
  id text primary key,
  bot_id text not null,
  payload jsonb not null,
  status text not null check (status in ('pending', 'processing', 'completed', 'failed')),
  result jsonb,
  error text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  processing_started_at timestamp with time zone,
  completed_at timestamp with time zone,
  failed_at timestamp with time zone
);

-- Add indexes
create index if not exists signal_queue_bot_id_idx on signal_queue(bot_id);
create index if not exists signal_queue_status_idx on signal_queue(status);
create index if not exists signal_queue_created_at_idx on signal_queue(created_at);

-- No RLS policies for now - adding them later after table is working 