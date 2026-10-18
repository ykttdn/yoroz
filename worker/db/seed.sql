-- Replaces the transactions of the first user, so sign in once before applying it.
-- Each occurred_at counts from the start of the current month in Japan time, then goes back to UTC with '-9 hours'.
DELETE FROM transactions WHERE user_id = (SELECT min(id) FROM users);

INSERT INTO transactions (user_id, occurred_at, kind, amount, memo, created_at, updated_at) VALUES
  -- Two months ago
  ((SELECT min(id) FROM users), strftime('%s', 'now', '+9 hours', 'start of month', '-2 months', '+2 days', '+12:15', '-9 hours') * 1000, 'expense', 980, 'ランチ', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ((SELECT min(id) FROM users), strftime('%s', 'now', '+9 hours', 'start of month', '-2 months', '+9 days', '+18:00', '-9 hours') * 1000, 'expense', 4320, 'スーパー', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ((SELECT min(id) FROM users), strftime('%s', 'now', '+9 hours', 'start of month', '-2 months', '+24 days', '+09:00', '-9 hours') * 1000, 'income', 280000, '給与', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ((SELECT min(id) FROM users), strftime('%s', 'now', '+9 hours', 'start of month', '-1 months', '-1 minute', '-9 hours') * 1000, 'expense', 550, '境界: 月末 23:59（この月に出る）', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  -- Last month
  ((SELECT min(id) FROM users), strftime('%s', 'now', '+9 hours', 'start of month', '-1 months', '-9 hours') * 1000, 'expense', 600, '境界: 月初 00:00（この月に出る）', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ((SELECT min(id) FROM users), strftime('%s', 'now', '+9 hours', 'start of month', '-1 months', '+4 days', '+11:30', '-9 hours') * 1000, 'expense', 1200, 'ランチ', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ((SELECT min(id) FROM users), strftime('%s', 'now', '+9 hours', 'start of month', '-1 months', '+11 days', '+17:45', '-9 hours') * 1000, 'expense', 15800, '服', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ((SELECT min(id) FROM users), strftime('%s', 'now', '+9 hours', 'start of month', '-1 months', '+19 days', '+20:00', '-9 hours') * 1000, 'expense', 3200, '', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ((SELECT min(id) FROM users), strftime('%s', 'now', '+9 hours', 'start of month', '-1 months', '+24 days', '+09:00', '-9 hours') * 1000, 'income', 280000, '給与', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ((SELECT min(id) FROM users), strftime('%s', 'now', '+9 hours', 'start of month', '-1 minute', '-9 hours') * 1000, 'expense', 450, '境界: 月末 23:59（この月に出る）', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  -- This month
  ((SELECT min(id) FROM users), strftime('%s', 'now', '+9 hours', 'start of month', '-9 hours') * 1000, 'expense', 700, '境界: 月初 00:00（この月に出る）', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ((SELECT min(id) FROM users), strftime('%s', 'now', '+9 hours', 'start of month', '+1 days', '+19:00', '-9 hours') * 1000, 'expense', 8800, '電気代', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ((SELECT min(id) FROM users), strftime('%s', 'now', '+9 hours', 'start of month', '+4 days', '+12:00', '-9 hours') * 1000, 'expense', 1100, 'ランチ', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ((SELECT min(id) FROM users), strftime('%s', 'now', '+9 hours', 'start of month', '+4 days', '+12:00', '-9 hours') * 1000, 'expense', 300, '同時刻の明細（id の降順で並ぶ）', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ((SELECT min(id) FROM users), strftime('%s', 'now', '+9 hours', 'start of month', '+5 days', '+19:30', '-9 hours') * 1000, 'expense', 3600, '改行を含むメモ' || char(10) || '2 行目', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ((SELECT min(id) FROM users), strftime('%s', 'now', '+9 hours', 'start of month', '+5 days', '+20:00', '-9 hours') * 1000, 'expense', 2980, '短くても改行で 4 行になるメモ' || char(10) || '2 行目' || char(10) || '3 行目' || char(10) || '4 行目（続きを読むで出る）', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ((SELECT min(id) FROM users), strftime('%s', 'now', '+9 hours', 'start of month', '+6 days', '+20:00', '-9 hours') * 1000, 'expense', 1000000, '上限の 200 文字のメモ。日本語の文章が長く続いたときに、折り返しと金額の位置が崩れないかを確かめる。上限の 200 文字のメモ。日本語の文章が長く続いたときに、折り返しと金額の位置が崩れないかを確かめる。上限の 200 文字のメモ。日本語の文章が長く続いたときに、折り返しと金額の位置が崩れないかを確かめる。上限の 200 文字のメモ。日本語の文章が長く続いたときに、折り返しと金額の位置が崩れな', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ((SELECT min(id) FROM users), strftime('%s', 'now', '+9 hours', 'start of month', '+7 days', '+20:00', '-9 hours') * 1000, 'income', 1000000, 'NoSpacesUpTo200Characters_NoSpacesUpTo200Characters_NoSpacesUpTo200Characters_NoSpacesUpTo200Characters_NoSpacesUpTo200Characters_NoSpacesUpTo200Characters_NoSpacesUpTo200Characters_NoSpacesUpTo200Cha', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ((SELECT min(id) FROM users), strftime('%s', 'now', '+9 hours', 'start of month', '+9 days', '+15:20', '-9 hours') * 1000, 'income', 5000, '臨時収入', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ((SELECT min(id) FROM users), strftime('%s', 'now', '+9 hours', 'start of month', '+10 days', '+21:00', '-9 hours') * 1000, 'expense', 2400, 'メモが長い明細。表の折り返しを確かめるために、ある程度の長さの文章を入れておく。', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);
