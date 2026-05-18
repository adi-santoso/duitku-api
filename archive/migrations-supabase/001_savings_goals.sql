-- Savings Goals table
CREATE TABLE IF NOT EXISTS savings_goals (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  target_date DATE,
  icon TEXT DEFAULT '🎯',
  color TEXT DEFAULT '#10B981',
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Savings Contributions table (history of deposits)
CREATE TABLE IF NOT EXISTS savings_contributions (
  id SERIAL PRIMARY KEY,
  goal_id INTEGER NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_savings_goals_user_id ON savings_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_contributions_goal_id ON savings_contributions(goal_id);

-- RLS Policies
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_contributions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (backend uses service role key)
CREATE POLICY "Service role full access on savings_goals"
  ON savings_goals FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on savings_contributions"
  ON savings_contributions FOR ALL
  USING (true)
  WITH CHECK (true);
