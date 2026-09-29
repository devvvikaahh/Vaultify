let derivedKey = null;
let savedVault = []; // Temporary array to hold encrypted passwords

// Function to derive an encryption key from the Master Password using PBKDF2
async function deriveEncryptionKey(masterPassword, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(masterPassword),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    return await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

// Function to encrypt a password
async function encryptPassword(secretPassword, key) {
    const enc = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        enc.encode(secretPassword)
    );

    return {
        ciphertext: Array.from(new Uint8Array(encrypted)),
        iv: Array.from(iv)
    };
}

// Function to decrypt a password
async function decryptPassword(ciphertextArray, ivArray, key) {
    const dec = new TextDecoder();
    
    const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(ivArray) },
        key,
        new Uint8Array(ciphertextArray)
    );

    return dec.decode(decrypted);
}

// --- UI Event Listeners ---

// Unlock Vault Event
document.getElementById('unlockBtn').addEventListener('click', async () => {
    const masterPassword = document.getElementById('masterPassword').value;

    if (!masterPassword) {
        alert("Please enter your master password!");
        return;
    }

    try {
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        derivedKey = await deriveEncryptionKey(masterPassword, salt);
        
        // Hide login section and show dashboard
        document.getElementById('loginSection').classList.add('hidden');
        document.getElementById('dashboardSection').classList.remove('hidden');

        // Start inactivity timer
        resetInactivityTimer();

    } catch (error) {
        console.error("Error unlocking vault:", error);
        alert("Failed to unlock vault.");
    }
});

// Save Password Event
document.getElementById('saveBtn').addEventListener('click', async () => {
    const siteName = document.getElementById('siteName').value;
    const sitePassword = document.getElementById('sitePassword').value;

    if (!siteName || !sitePassword) {
        alert("Please fill in both fields!");
        return;
    }

    try {
        const encryptedData = await encryptPassword(sitePassword, derivedKey);
        savedVault.push({ site: siteName, data: encryptedData });

        document.getElementById('siteName').value = '';
        document.getElementById('sitePassword').value = '';

        updatePasswordList();
    } catch (error) {
        console.error("Encryption error:", error);
        alert("Failed to encrypt password.");
    }
});

// Function to update the displayed password list
function updatePasswordList() {
    const listContainer = document.getElementById('passwordList');
    listContainer.innerHTML = '';

    savedVault.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'password-item';
        div.innerHTML = `
            <span>🔒 ${item.site}</span>
            <button onclick="revealPassword(${index})" style="width: auto; padding: 0.4rem 0.8rem; font-size: 0.8rem; margin: 0;">Decrypt</button>
        `;
        listContainer.appendChild(div);
    });
}

// Function to decrypt and show password when clicked
window.revealPassword = async function(index) {
    const item = savedVault[index];
    try {
        const decryptedPass = await decryptPassword(item.data.ciphertext, item.data.iv, derivedKey);
        alert(`Password for ${item.site}: ${decryptedPass}`);
    } catch (error) {
        console.error("Decryption error:", error);
        alert("Failed to decrypt password.");
    }
}

// --- Auto-Lock / Inactivity Timeout ---
let inactivityTimer;
const TIMEOUT_LIMIT = 2 * 60 * 1000; // 2 മിനിറ്റ്

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    
    const dashboard = document.getElementById('dashboardSection');
    if (dashboard && !dashboard.classList.contains('hidden')) {
        inactivityTimer = setTimeout(() => {
            lockVaultAutomatically();
        }, TIMEOUT_LIMIT);
    }
}

function lockVaultAutomatically() {
    derivedKey = null;
    savedVault = [];
    
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('loginSection').classList.remove('hidden');
    
    document.getElementById('masterPassword').value = '';
    document.getElementById('passwordList').innerHTML = '';
    
    alert("Security Alert: Vault locked automatically due to inactivity.");
}

window.addEventListener('mousemove', resetInactivityTimer);
window.addEventListener('keypress', resetInactivityTimer);
window.addEventListener('click', resetInactivityTimer);