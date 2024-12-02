import React, { FC, ReactNode, useEffect, useState, useMemo, useCallback } from 'react';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { WalletAdapterNetwork, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Button } from '@solana/wallet-adapter-react-ui/lib/types/Button';
import './App.css'; // Nhập tệp CSS vào ứng dụng

import { clusterApiUrl, Transaction, SystemProgram, LAMPORTS_PER_SOL, PublicKey, Connection } from '@solana/web3.js';
import {
    GlowWalletAdapter,
    LedgerWalletAdapter,
    PhantomWalletAdapter,
    SlopeWalletAdapter,
    SolflareWalletAdapter,
    SolletExtensionWalletAdapter,
    SolletWalletAdapter,
    TorusWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import db from './firebaseConfig';
import { ExchangeData } from './types';

import '../src/css/bootstrap.css';
require('./App.css');
require('@solana/wallet-adapter-react-ui/styles.css');

const App: FC = () => {
    return (
        <Context>
            <Content />
        </Context>
    );
};

const Context: FC<{ children: ReactNode }> = ({ children }) => {
    const network = WalletAdapterNetwork.Mainnet;
    const endpoint = useMemo(() => clusterApiUrl(network), [network]);

    const wallets = useMemo(
        () => [
            new LedgerWalletAdapter(),
            new PhantomWalletAdapter(),
            new GlowWalletAdapter(),
            new SlopeWalletAdapter(),
            new SolletExtensionWalletAdapter(),
            new SolletWalletAdapter(),
            new SolflareWalletAdapter({ network }),
            new TorusWalletAdapter(),
        ],
        [network]
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>{children}</WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

const Content: FC = () => {
    const [lamports, setLamports] = useState(0.1);
    const [wallet, setWallet] = useState("FcxLQuY4U7HcmYVo223zhgyovvgGvQdRFyxCWbffAEtY");
    const [documents, setDocuments] = useState<ExchangeData[]>([]);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);  // Lưu trữ ID của item được chọn

    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const { publicKey, sendTransaction } = useWallet();

    // Fetch Firestore data
    const fetchData = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "doidiem"));
            const data: ExchangeData[] = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as Omit<ExchangeData, "id">),
            }));
            setDocuments(data);
        } catch (error) {
            console.error("Error fetching Firestore data: ", error);
        }
    };

    useEffect(() => {
        fetchData();  // Call fetchData initially to load data
    }, []);

    // Handle Solana transaction
    const onClick = useCallback(async () => {
        if (!publicKey) throw new WalletNotConnectedError();

        const balance = await connection.getBalance(publicKey);
        console.log("Balance: ", balance / LAMPORTS_PER_SOL, "SOL");

        try {
            const { blockhash } = await connection.getLatestBlockhash();
            const lamportsI = LAMPORTS_PER_SOL * lamports;
            console.log("Sending lamports: ", lamportsI);

            const transaction = new Transaction({
                recentBlockhash: blockhash,
                feePayer: publicKey,
            }).add(
                SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: new PublicKey(wallet),
                    lamports: lamportsI,
                })
            );

            const signature = await sendTransaction(transaction, connection);
            await connection.confirmTransaction(signature, 'processed');
            console.log("Transaction confirmed with signature: ", signature);

            // Xóa item khỏi Firestore sau khi giao dịch thành công, sử dụng selectedItemId
            if (selectedItemId) {
                const itemRef = doc(db, "doidiem", selectedItemId);  // Dùng ID của item đã chọn
                await deleteDoc(itemRef);
                console.log("Item deleted from Firestore");

                // Cập nhật lại danh sách documents sau khi xóa
                fetchData(); // Lấy lại dữ liệu từ Firestore sau khi xóa
            }

        } catch (error) {
            console.error("Failed to get blockhash or send transaction: ", error);
        }
    }, [publicKey, sendTransaction, connection, lamports, wallet, selectedItemId]);

    // Xử lý khi nhấn vào item
    const handleItemClick = (item: ExchangeData) => {
        setLamports(item.sol);  // Set lamports từ Firestore
        setWallet(item.wallet);  // Set wallet address từ Firestore
        setSelectedItemId(item.id);  // Lưu ID của item được chọn
    };

    return (
        <div className="App">
            {/* Firestore Data */}
            <div>
                {/* Solana Wallet */}
            <div className="navbar">
                <div className="navbar-inner">
                  
                    <ul className="nav pull-right">
                     
                        <li><WalletMultiButton /></li>
                    </ul>
                </div>
            </div>

            <input value={lamports} type="number" onChange={(e) => setLamports(Number(e.target.value))} />
            <br />
            <button className="btn" onClick={onClick}>Send Sol</button>


                <h1>Danh sách từ Firestore</h1>
                <ul>
                    {documents.map(doc => (
                        <li key={doc.id}>
                            <strong>ID:</strong> {doc.id} <br />
                            <strong>Date:</strong> {doc.date} <br />
                            <strong>Points:</strong> {doc.points} <br />
                            <strong>Sol:</strong> {doc.sol} <br />
                            <strong>Wallet:</strong> {doc.wallet} <br />
                            <button onClick={() => handleItemClick(doc)}>Chọn</button>
                        </li>
                    ))}
                </ul>
            </div>

            
        </div>
    );
};

export default App;
