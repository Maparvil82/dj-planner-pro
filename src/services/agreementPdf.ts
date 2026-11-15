import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

export async function prepareAgreementPdf(
    html: string,
    sessionId: string,
): Promise<string | null> {
    if (Platform.OS === 'web') return null;
    const { uri } = await Print.printToFileAsync({
        html,
        width: 595,
        height: 842,
    });
    const file = new File(
        Paths.cache,
        `DJ-Planner-acuerdo-${sessionId}-${Date.now()}.pdf`,
    );
    if (file.exists) file.delete();
    new File(uri).move(file);
    return file.uri;
}
export async function shareAgreementPdf(uri: string | null, html: string) {
    if (Platform.OS === 'web') {
        // Browser print lets the user choose Save as PDF without a remote service.
        const frame = document.createElement('iframe');
        frame.style.position = 'fixed';
        frame.style.width = '0';
        frame.style.height = '0';
        frame.style.border = '0';
        document.body.appendChild(frame);
        frame.onload = () => {
            frame.contentWindow?.focus();
            frame.contentWindow?.print();
            setTimeout(() => frame.remove(), 60000);
        };
        frame.srcdoc = html;
        return;
    }
    if (!uri || !(await Sharing.isAvailableAsync()))
        throw new Error('agreementPdf.error');
    await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
    });
}
