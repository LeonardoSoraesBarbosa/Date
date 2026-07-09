import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parsing middleware
  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Server-side email proxy supporting FormSubmit and Web3Forms fallback
  app.post("/api/confirm-date", async (req, res) => {
    try {
      const { guestName, date, timeSlot, notes, web3formsKey } = req.body;
      
      // Determine the Web3Forms access key to use (passed from UI or fallback to the user's default key)
      const finalWeb3Key = (web3formsKey && web3formsKey.trim()) || '9fca0c5e-f914-4617-926f-e44578bd3181';
      
      console.log(`Iniciando envio. Chave Web3Forms utilizada: ${finalWeb3Key}`);

      // 1. Try Web3Forms as the absolute primary choice
      try {
        const payload = {
          access_key: finalWeb3Key,
          subject: guestName ? `🎫 DATE CONFIRMADO POR ${guestName.toUpperCase()}! 🍕` : "🎫 NOVO DATE CONFIRMADO! 🍕",
          from_name: "Pedido de Date 🌹",
          "Convidado(a)": guestName || "Não identificado (usou link geral)",
          "Data Marcada": date,
          "Horário Selecionado": timeSlot,
          "Notas do Rolê": notes || "Sem sugestões adicionais",
          "Mensagem": "Parabéns! O encontro foi agendado com sucesso e os detalhes estão confirmados."
        };

        console.log("Enviando e-mail do servidor para Web3Forms:", payload);

        const response = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log("Resposta do Web3Forms no servidor:", data);

        if (response.ok && data.success) {
          return res.json({ success: true, data, provider: 'web3forms' });
        } else {
          console.warn("Envio via Web3Forms falhou ou retornou erro, tentando fallback para FormSubmit...");
        }
      } catch (web3Error) {
        console.error("Erro na requisição para Web3Forms, tentando fallback para FormSubmit:", web3Error);
      }

      // 2. Fallback to FormSubmit if Web3Forms fails or isn't successful
      const payloadFS = {
        _subject: guestName ? `🎫 DATE CONFIRMADO POR ${guestName.toUpperCase()}! 🍕` : "🎫 NOVO DATE CONFIRMADO! 🍕",
        _captcha: "false",
        "Convidado(a)": guestName || "Não identificado (usou link geral)",
        "Data Marcada": date,
        "Horário Selecionado": timeSlot,
        "Notas do Rolê": notes || "Sem sugestões adicionais",
        "Mensagem": "Parabéns! O encontro foi agendado com sucesso e os detalhes estão confirmados."
      };

      console.log("Enviando e-mail do servidor para FormSubmit como fallback:", payloadFS);

      const responseFS = await fetch('https://formsubmit.co/ajax/soaresbarbosaleonardo@gmail.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payloadFS)
      });

      const dataFS = await responseFS.json();
      console.log("Resposta do FormSubmit no servidor:", dataFS);

      if (responseFS.ok && dataFS.success !== 'false' && dataFS.success !== false) {
        return res.json({ success: true, data: dataFS, provider: 'formsubmit' });
      } else {
        return res.status(400).json({ success: false, message: dataFS?.message || 'Erro do FormSubmit' });
      }
    } catch (error: any) {
      console.error("Erro ao enviar e-mail pelo servidor:", error);
      return res.status(500).json({ success: false, message: error.message || 'Erro de conexão no servidor' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
