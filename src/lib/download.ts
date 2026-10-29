// Hands the person a file made on the device: the browser saves it and nothing is sent anywhere
function downloadFile(name: string, content: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // The browser has started reading the file by the time a second has gone by
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export { downloadFile };
