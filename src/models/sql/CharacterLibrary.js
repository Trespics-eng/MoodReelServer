import { getSupabase } from '../../config/supabase.js';

const CharacterLibraryModel = {
  async getAll(userId = null) {
    const supabase = getSupabase();
    if (!supabase) return this.getDefaultPresets();

    let query = supabase.from('characters').select('*');
    if (userId) {
      query = query.or(`is_public.eq.true,user_id.eq.${userId}`);
    } else {
      query = query.eq('is_public', true);
    }
    
    const { data, error } = await query.order('name', { ascending: true });

    if (error) throw new Error(error.message);
    return data || this.getDefaultPresets();
  },

  getDefaultPresets() {
    return [
      {
        id: 'pres-1',
        name: 'The Reluctant Hero',
        personality: 'Brave but humble, often doubts their own potential.',
        role: 'Protagonist',
        image_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
        characteristics: 'Swift, empathetic, skilled with a blade.'
      },
      {
        id: 'pres-2',
        name: 'The Wise Mentor',
        personality: 'Calm, patient, and cryptic. Always knows more than they let on.',
        role: 'Guide',
        image_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
        characteristics: 'Old, grey-bearded, carries a staff of light.'
      },
      {
        id: 'pres-3',
        name: 'The Shadow Stalker',
        personality: 'Cynical, observant, and fiercely independent.',
        role: 'Anti-Hero',
        image_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
        characteristics: 'Wears a dark cloak, expert in stealth.'
      },
       {
        id: 'pres-4',
        name: 'The Ruthless Antagonist',
        personality: 'Calculating, power-hungry, and lacking empathy.',
        role: 'Villain',
        image_url: 'https://images.unsplash.com/photo-1552058544-f2b08422138a?auto=format&fit=crop&q=80&w=200',
        characteristics: 'Sharp features, cold eyes, imposing presence.'
      },
      {
        id: 'pres-5',
        name: 'The Tech Specialist',
        personality: 'Energetic, brilliant, and slightly socially awkward.',
        role: 'Support',
        image_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=200',
        characteristics: 'Always has a gadget ready, wears oversized glasses.'
      }
    ];
  }
};

export default CharacterLibraryModel;
