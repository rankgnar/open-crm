-- Höjer max_tokens för Förslag-revisor från 4000 till 16000.
-- Anledning: deepseek/deepseek-v4-pro är en reasoning-modell — reasoning-tokens
-- konsumerar samma budget som output. Revisor returnerar dessutom hela tre listor
-- (arbete + material + material_webb) korrigerade, så outputen själv blir 4–8k
-- tokens. Med 4000 hinner modellen inte skriva något (Längd: 0 i error).
-- 16000 matchar Arbetskostnadsestimator (WF5) som har samma typ av storutskrift.

UPDATE ai_asistenter
SET max_tokens = 16000,
    uppdaterad_at = now()
WHERE namn = 'Förslag-revisor';
