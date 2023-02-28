
const fs = require('fs');
const path = require('path');
const express = require('express');
const expressWs = require('express-ws');
const bodyParser = require('body-parser');
const logger = require('cyber-express-logger');

const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const app = express();
expressWs(app);
app.use(bodyParser.json());
app.use(logger());
app.use(express.static(path.join(__dirname, 'web')));

const uploads = {};
const maxFileSize = 1024*1024*1024*5; // 5 GB
const maxChunkSize = 1024*256; // 256 KB

app.post('/upload/open', (req, res) => {
    const id = Date.now().toString();
    if (!req.body.name)
        return res.status(400).json({ success: false, error: 'missingName' });
    const name = req.body.name.replace(/[^a-zA-Z0-9-_ .]/g, '').substring(0, 128);
    if (!name)
        return res.status(400).json({ success: false, error: 'invalidName' });
    if (!req.body.size)
        return res.status(400).json({ success: false, error: 'missingSize' });
    if (req.body.size > maxFileSize || req.body.size < 1)
        return res.status(400).json({ success: false, error: 'invalidSize' });
    const size = req.body.size;
    uploads[id] = {
        id,
        name,
        size: {
            max: size,
            working: 0
        },
        file: {
            tmp: path.join(uploadDir, id),
            final: path.join(uploadDir, name)
        },
        isAppending: false
    };
    console.log(`Upload ${id} opened for ${name} (${size} bytes)`);
    res.json({ success: true, id: id, name: name });
});
app.ws('/upload/:id/append', (ws, req) => {
    const id = req.params.id;
    if (!uploads[id]) {
        ws.send(JSON.stringify({ type: 'close', reason: 'uploadNotFound' }));
        return ws.close();
    }
    if (uploads[id].isAppending) {
        ws.send(JSON.stringify({ type: 'close', reason: 'alreadyAppending' }));
        return ws.close();
    }
    uploads[id].isAppending = true;
    console.log(`Upload ${id} is being appended to...`);
    ws.on('message', async(data) => {
        const chunkSize = data.length;
        if (chunkSize > maxChunkSize) {
            ws.send(JSON.stringify({ type: 'close', reason: 'chunkTooLarge' }));
            return ws.close();
        }
        if ((uploads[id].size.working+chunkSize) > uploads[id].size.max) {
            ws.send(JSON.stringify({ type: 'close', reason: 'fileTooLarge' }));
            return ws.close();
        }
        try {
            fs.appendFileSync(uploads[id].file.tmp, data);
        } catch (error) {
            ws.send(JSON.stringify({ type: 'close', reason: 'writeError' }));
            return ws.close();
        }
        uploads[id].size.working += chunkSize;
        ws.send(JSON.stringify({ type: 'progress', size: uploads[id].size.working }));
    });
    ws.on('close', () => {
        uploads[id].isAppending = false;
        console.log(`Upload ${id} is no longer being appended to.`);
        if (uploads[id]) {
            console.log(`Deleting incomplete upload ${id}...`);
            fs.unlinkSync(uploads[id].file.tmp);
            delete uploads[id];
        }
    });
});
app.put('/upload/:id/close', (req, res) => {
    const id = req.params.id;
    if (uploads[id] && fs.existsSync(uploads[id].file.tmp)) {
        fs.renameSync(uploads[id].file.tmp, uploads[id].file.final);
        res.json({ success: true });
        delete uploads[id];
    } else {
        res.status(404).json({ success: false, error: 'Upload not found' });
    }
});

const port = 8080;
app.listen(port, () => console.log(`Listening on port ${port}`));