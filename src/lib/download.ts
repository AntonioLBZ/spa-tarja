// Hands the person a file made on the device: the browser saves it and nothing is sent anywhere
function downloadFile(name: string, content: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // A browser may start reading the file well after the click, so the address stays valid for a while
    setTimeout(() => URL.revokeObjectURL(url), 40_000);
}

export { downloadFile };
