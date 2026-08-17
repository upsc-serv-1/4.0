import sqlite3
import json

conn = sqlite3.connect('C:/Users/Dr. Yogesh/Videos/APP FOLDER - V1 - Copy/pilot_pro.db')
c = conn.cursor()
c.execute("SELECT answer FROM Questions WHERE answer LIKE '%Land Dispossession and Resource Conflicts%'")
row = c.fetchone()
if row:
    print(json.dumps(row[0]))
else:
    print('Not found')
conn.close()
