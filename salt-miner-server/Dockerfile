# Salt miner server for Agentico — requires Foundry + Rust miner
# Build from parent dir that has both Agentico and liquidity-launcher:
#   docker build -f Agentico/salt-miner-server/Dockerfile -t agentico-salt-miner .

# Build address-miner
FROM rust:latest AS miner
WORKDIR /build
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

COPY Agentico/contracts/script/saltGenerator ./
# Update dependencies to latest compatible versions
RUN cargo update && cargo build --release

# Final image
FROM ghcr.io/foundry-rs/foundry:latest
WORKDIR /app

# Contracts expect liquidity-launcher at ../../liquidity-launcher (sibling)
COPY Agentico/contracts ./contracts
COPY liquidity-launcher ./liquidity-launcher

# Copy built miner
COPY --from=miner /build/target/release/address-miner ./contracts/script/saltGenerator/target/release/address-miner

# Copy salt-miner-server
COPY Agentico/salt-miner-server/package*.json ./salt-miner-server/
COPY Agentico/salt-miner-server/src ./salt-miner-server/src
COPY Agentico/salt-miner-server/tsconfig.json ./salt-miner-server/

RUN cd salt-miner-server && npm ci && npm run build

ENV CONTRACTS_DIR=/app/contracts
ENV PORT=3040

EXPOSE 3040

CMD ["node", "salt-miner-server/dist/index.js"]
