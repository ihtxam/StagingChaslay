-- POS session heartbeat: main till reports Print Agent status for mobile/waiter UI
ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS print_agent_online boolean;
