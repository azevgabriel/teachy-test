FROM public.ecr.aws/lambda/python:3.12

# Instala as dependências de sistema do Amazon Linux 2023 para execução do Chromium headless e Node.js
RUN dnf install -y \
    libatomic \
    atk \
    at-spi2-atk \
    cups-libs \
    libdrm \
    libXcomposite \
    libXcursor \
    libXdamage \
    libXext \
    libXi \
    libXrandr \
    libXScrnSaver \
    libXtst \
    pango \
    at-spi2-core \
    alsa-lib \
    gtk3 \
    mesa-libgbm \
    libxkbcommon \
    nss \
    nspr \
    liberation-sans-fonts \
    liberation-mono-fonts \
    liberation-serif-fonts \
    xorg-x11-fonts-Type1 \
    xorg-x11-fonts-misc \
    && dnf clean all

# Define o diretório dos navegadores do Playwright compatível com AWS Lambda
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true

# Copia e instala as dependências Python
COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt

# Instala exclusivamente o binário Chromium para manter a imagem leve
RUN playwright install chromium

# Copia os módulos da aplicação para o TASK_ROOT do Lambda
COPY handler.py docx_renderer.py pdf_renderer.py ${LAMBDA_TASK_ROOT}/

# Handler padrão da AWS Lambda
CMD [ "handler.handler" ]
