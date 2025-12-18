import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';

const dbPath = './tmp/db.sqlite';
const downloadsPath = './storage/downloads';
const referencesPath = './storage/references';

const db = new sqlite3.Database(dbPath);

async function syncDatabase() {
  console.log('🔄 Starting database synchronization...');
  
  // 1. Fix projects with reference files
  const referenceFiles = fs.readdirSync(referencesPath).filter(f => f.endsWith('.json'));
  
  for (const refFile of referenceFiles) {
    const refData = JSON.parse(fs.readFileSync(path.join(referencesPath, refFile), 'utf8'));
    const projectId = refData.projectId;
    const videoFile = refData.referenceTo;
    const videoPath = path.join(process.cwd(), downloadsPath, videoFile);
    
    console.log(`📁 Updating project ${projectId} with reference: ${videoFile}`);
    
    db.run(
      `UPDATE video_projects SET video_file_path = ?, status = 'completed' WHERE id = ?`,
      [videoPath, projectId],
      function(err) {
        if (err) console.error(`❌ Error updating project ${projectId}:`, err);
        else console.log(`✅ Updated project ${projectId}`);
      }
    );
  }
  
  // 2. Fix project 10 (DYEZ4aWk5yg) - should be completed
  const dyezFile = path.join(process.cwd(), downloadsPath, 'DYEZ4aWk5yg_720p_true.mp4');
  if (fs.existsSync(dyezFile)) {
    console.log('🔧 Fixing project 10 status (DYEZ4aWk5yg)');
    
    db.run(
      `UPDATE video_projects SET status = 'completed', video_file_path = ? WHERE id = 10`,
      [dyezFile],
      function(err) {
        if (err) console.error('❌ Error fixing project 10:', err);
        else console.log('✅ Fixed project 10 status');
      }
    );
  }
  
  setTimeout(() => {
    console.log('✅ Database synchronization completed!');
    db.close();
  }, 2000);
}

syncDatabase().catch(console.error);
