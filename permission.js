document.getElementById('auth-btn').addEventListener('click', () => {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        stream.getTracks().forEach(t => t.stop());
        alert("Success. You can close this and click Baymax's face.");
        window.close();
    });
});