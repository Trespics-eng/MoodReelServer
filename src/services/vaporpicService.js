import { spawn } from 'child_process';
import path from 'path';

// Assuming vaporpic project is a sibling to MoodReelServer based on workspace layout
const VAPORPIC_DIR = path.resolve(process.cwd(), '../vaporpic');

const VaporpicService = {
  async getStreamLinks(title, type = 'movie', season = '1', episode = '1') {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python', [
        'vaporpic_bridge.py',
        '--type', type,
        '--title', title,
        '--season', season,
        '--episode', episode
      ], {
        cwd: VAPORPIC_DIR
      });

      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pythonProcess.on('close', (code) => {
        try {
          // Parse the last line as JSON to avoid stdout clutter
          const lines = output.trim().split('\n');
          const jsonLine = lines[lines.length - 1]; 
          
          if (!jsonLine) {
            return reject(new Error('Empty response from vaporpic script'));
          }

          const result = JSON.parse(jsonLine);
          
          if (result.success) {
            resolve(result.links);
          } else {
            console.error('Vaporpic search failed:', result.error);
            resolve([]); // Return empty array so frontend gracefully updates
          }
        } catch (e) {
          console.error('Failed to parse vaporpic output:', output);
          console.error('Error output from vaporpic:', errorOutput);
          resolve([]); // Graceful fallback
        }
      });
    });
  }
};

export default VaporpicService;
