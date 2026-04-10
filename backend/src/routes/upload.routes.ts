import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { uploadMedia } from '../controllers/upload.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Garantir que a pasta exista
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuração do Multer (Storage local)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

// Limites: 30MB pra video, 5MB resto => colocaremos um hard limit de 35MB para bater com tudo, 
// e podemos refinar no frontend ou aqui mesmo checando o mimetype
const upload = multer({ 
    storage,
    limits: {
        fileSize: 35 * 1024 * 1024 // 35MB absoluto máximo
    }
});

router.post('/upload', authMiddleware, upload.single('media'), (req, res, next) => {
    // Verificações extras de mimetype e size
    if (req.file) {
        const isVideo = req.file.mimetype.startsWith('video/');
        const mb = req.file.size / (1024 * 1024);
        
        // Se for doc/imagem > 5MB
        if (!isVideo && mb > 5) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Arquivos de imagem/documento/áudio devem ter até 5MB.' });
        }
        
        // Se for vídeo > 30MB
        if (isVideo && mb > 30) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Arquivos de vídeo devem ter até 30MB.' });
        }
    }
    
    next();
}, uploadMedia);

export default router;
