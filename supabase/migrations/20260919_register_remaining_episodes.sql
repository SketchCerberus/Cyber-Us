-- Apply after the existing community migrations. No policy or existing episode is changed.
insert into public.episodes (slug, title_pt, title_en, sort_order, community_enabled)
values
  ('episodio-02', 'Processando', 'Processing', 2, true),
  ('episodio-03', 'Procurando', 'Searching', 3, true),
  ('episodio-04', 'Prosseguindo', 'Proceeding', 4, true),
  ('episodio-05', 'Reiniciando', 'Rebooting', 5, true),
  ('marco-zero', 'Memória — Marco Zero', 'Memory — Ground Zero', 6, true)
on conflict (slug) do nothing;
