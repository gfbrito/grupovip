import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export const uploadMedia = (req: AuthenticatedRequest, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
        }

        // Retorna a URL pública baseada no domínio backend
        // Como o backend vai servir essas fotos através do `/uploads` 
        const protocol = req.protocol;
        const host = req.get('host');
        // A raiz é /uploads/[filename]
        const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

        return res.status(200).json({
            message: 'Arquivo recebido.',
            url: fileUrl,
            filename: req.file.filename,
            size: req.file.size,
            mimetype: req.file.mimetype,
        });

    } catch (e) {
        console.error('Erro no upload de midia:', e);
        return res.status(500).json({ error: 'Erro ao processar o arquivo no servidor.' });
    }
};
