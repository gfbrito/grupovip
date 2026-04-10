import fs from 'fs';
import path from 'path';

export function deleteLocalMedia(url?: string | null) {
    if (!url) return;
    // Verifica se a URL refere-se ao nosso diretório estático local
    if (url.includes('/uploads/')) {
        try {
            const filename = url.split('/uploads/').pop();
            if (filename) {
                // Como este arquivo está em /src/utils/file.ts, o uploads fica em ../../uploads
                const filePath = path.join(__dirname, '../../uploads', filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`[File Cleanup] Arquivo deletado fisicamente: ${filename}`);
                }
            }
        } catch (e) {
            console.error('[File Cleanup] Falha ao deletar mídia:', e);
        }
    }
}
