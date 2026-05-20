import torch
import torch.nn as nn

class TransformerAutoencoder(nn.Module):
    def __init__(self, input_dim, d_model=64, nhead=4, num_layers=2, dim_feedforward=128):
        super(TransformerAutoencoder, self).__init__()
        self.embedding = nn.Linear(input_dim, d_model)
        
        # Transformer Encoder Layer
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model, 
            nhead=nhead, 
            dim_feedforward=dim_feedforward, 
            batch_first=True
        )
        self.transformer_encoder = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
        
        # Output Layer (Reconstruction)
        self.decoder = nn.Linear(d_model, input_dim)

    def forward(self, x):
        # x shape: [batch, seq_len, input_dim]
        x = self.embedding(x)
        x = self.transformer_encoder(x)
        x = self.decoder(x)
        return x
