-- Labour court appeal (odwołanie do sądu pracy, art. 83 ust. 5 ustawy) as an evaluation event. The value is
-- alone in its migration: it is used only by the next ones.
alter type public.evaluation_event_kind add value 'labour_court_appeal';
