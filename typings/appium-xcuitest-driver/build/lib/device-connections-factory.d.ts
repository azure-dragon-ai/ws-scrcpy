declare class HjhDeviceConnectionsFactory {
    listConnections (udid?: string | null, port?: string | null, strict?: boolean): string[];
    requestConnection(
        udid: string,
        port: number,
        options: { usePortForwarding?: boolean; devicePort?: number },
    ): Promise<void>;
    releaseConnection(udid: string | null, port: number | null): void;
}
declare const DEVICE_CONNECTIONS_FACTORY: HjhDeviceConnectionsFactory;

export { DEVICE_CONNECTIONS_FACTORY, HjhDeviceConnectionsFactory };
export default DEVICE_CONNECTIONS_FACTORY;
