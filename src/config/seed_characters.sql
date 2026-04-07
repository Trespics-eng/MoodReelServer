-- Seed Data for Preset Public Characters (Movie & Animation suitable)

INSERT INTO characters (user_id, name, image_url, role, personality, background, traits, is_public) 
VALUES 

-- Animation focused characters
(
  NULL, 
  'Elara Starweaver', 
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80', 
  'Protagonist', 
  'Brave, curious, and fiercely loyal. She always looks for the best in people but struggles with her own magical potential.', 
  'Raised in the floating city of Aethelgard, she discovered an ancient artifact that bound itself to her soul, drawing the attention of dark forces.', 
  '["Brave", "Curious", "Magical", "Loyal"]'::jsonb, 
  true
),
(
  NULL, 
  'Malakor the Void', 
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80', 
  'Antagonist', 
  'Cold, calculating, and driven by a singular vision of universal order through destruction.', 
  'Once a respected guardian of the cosmos, he was corrupted by the dark energy of the Abyss and now seeks to remake the universe in his own image.', 
  '["Ruthless", "Intelligent", "Corrupted", "Powerful"]'::jsonb, 
  true
),
(
  NULL, 
  'Zephyr', 
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80', 
  'Sidekick', 
  'Optimistic, energetic, and a bit clumsy. Uses humor as a defense mechanism but always comes through when it matters.', 
  'A street-smart mechanic from the lower levels who accidentally got swept up in a galaxy-saving adventure.', 
  '["Funny", "Resourceful", "Loyal", "Clumsy"]'::jsonb, 
  true
),

-- Movie focused characters
(
  NULL, 
  'Detective James Cole', 
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80', 
  'Protagonist', 
  'Cynical and world-weary, yet deeply committed to finding the truth. Struggles with his past mistakes.', 
  'A veteran homicide detective in a dystopian neo-noir city. His last case cost him his family, and he is determined not to fail again.', 
  '["Gritty", "Determined", "Cynical", "Observant"]'::jsonb, 
  true
),
(
  NULL, 
  'Dr. Sarah Chen', 
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80', 
  'Mentor', 
  'Brilliant, pragmatic, and highly logical. She values scientific progress but holds a deep empathy for humanity.', 
  'The lead researcher on a revolutionary AI experiment that went wrong. She now operates from the shadows to fix the world she helped break.', 
  '["Genius", "Pragmatic", "Guilt-ridden", "Visionary"]'::jsonb, 
  true
),
(
  NULL, 
  'Marcus Blackwood', 
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80', 
  'Antagonist', 
  'Charming, sophisticated, and utterly devoid of empathy. Operates with terrifying calmness.', 
  'A self-made billionaire industrialist who secretly controls the city''s underground criminal empire.', 
  '["Charming", "Sociopathic", "Wealthy", "Manipulative"]'::jsonb, 
  true
);
