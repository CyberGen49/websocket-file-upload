
function log(text, error = false) {
    const log = $('#log');
    const el = document.createElement('div');
    el.innerText = `[${dayjs().format('hh:mm:ss')}] ${text}`;
    el.classList.toggle('text-danger', error);
    log.insertAdjacentElement('afterbegin', el);
}

async function uploadFile(file) {
    log(`Selected file: ${file.name} (${file.size} bytes)`);
    log(`Opening upload...`);
    const res = await axios.post('/upload/open', {
        name: file.name,
        size: file.size
    });
    if (!res.data.success)
        return log(`Failed to open upload: ${res.data.error}`, true);
    const id = res.data.id;
    const name = res.data.name;
    const btnCancel = $('#btnCancelUpload');
    let isCancelled = false;
    btnCancel.disabled = false;
    btnCancel.addEventListener('click', () => {
        isCancelled = true;
        btnCancel.disabled = true;
    });
    log(`Starting upload of "${name}" as ID ${id}...`);
    const ws = new WebSocket(`ws://${window.location.host}/upload/${id}/append`);
    ws.addEventListener('open', async() => {
        const progressResolvers = [];
        ws.addEventListener('message', (e) => {
            const data = JSON.parse(e.data);
            if (data.type === 'progress') {
                log(`Uploaded ${formatSize(data.size)}, ${Math.round(data.size/file.size*100)}% complete...`);
                progressResolvers.shift()();
            } else if (data.type === 'close') {
                log(`Upload failed: ${data.reason}`, true);
            }
        });
        const progress = () => new Promise((resolve, reject) => {
            progressResolvers.push(resolve);
        });
        const chunkSize = 1024*128; // 128 KB chunks
        const chunkCount = Math.ceil(file.size/chunkSize);
        for (let i = 0; i < chunkCount; i++) {
            const start = i*chunkSize;
            const end = Math.min(file.size, start+chunkSize);
            const slice = file.slice(start, end);
            const chunk = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsArrayBuffer(slice);
            });
            ws.send(chunk);
            await progress();
            if (isCancelled) {
                log(`Upload cancelled.`, true);
                return ws.close();
            }
        }
        log(`Closing upload...`);
        const closeRes = await axios.put(`/upload/${id}/close`);
        ws.close();
        if (!closeRes.data.success)
            return log(`Failed to close upload: ${closeRes.data.error}`, true);
        log(`Upload complete!`);
        btnCancel.disabled = true;
    });
}

window.addEventListener('load', () => {
    const btnSelectFile = $('#btnSelectFile');
    btnSelectFile.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            uploadFile(file);
        });
        fileInput.click();
    });
    log(`Pick a file to start uploading!`);
});