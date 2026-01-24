import logger from "./utils/logger";
import CryptoJS from 'crypto-js';

export const getEncryptDecryptNoUserName = async (): Promise<string> => {
  const data2 = "8216EB35-BB77-49AD-94CA-A7C3520DC464";
  const iv = "F5cEUty4UwQL2EyW";
  const key = "CHqcPp7MN3mTY3nF6TWHdG8dHPVSgJBj";

  const fkey = CryptoJS.enc.Utf8.parse(key);
  const fiv = CryptoJS.enc.Utf8.parse(iv);

  const enc = CryptoJS.AES.encrypt(data2, fkey, {
    iv: fiv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const final = enc.ciphertext.toString(CryptoJS.enc.Base64);

  sessionStorage.setItem("xapikeyNoAccessToken", final);
  localStorage.setItem("xapikeyNoAccessToken", final);

  logger.log("Generated API key:", final);
  return final;
};

export const getStoredApiKey = (): string | null => {
  return localStorage.getItem("xapikeyNoAccessToken") || sessionStorage.getItem("xapikeyNoAccessToken");
}; 