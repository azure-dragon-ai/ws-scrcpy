import WS from 'ws';
import { Mw, RequestParameters } from '../../mw/Mw';
import { ControlCenterCommand } from '../../../common/ControlCenterCommand';
import { ControlCenter } from '../services/ControlCenter';
import { ACTION } from '../../../common/Action';
import GoogHjhDeviceDescriptor from '../../../types/GoogHjhDeviceDescriptor';
import { HjhDeviceTrackerEvent } from '../../../types/HjhDeviceTrackerEvent';
import { HjhDeviceTrackerEventList } from '../../../types/HjhDeviceTrackerEventList';
import { Multiplexer } from '../../../packages/multiplexer/Multiplexer';
import { ChannelCode } from '../../../common/ChannelCode';

export class HjhDeviceTracker extends Mw {
    public static readonly TAG = 'HjhDeviceTracker';
    public static readonly type = 'android';
    private adt: ControlCenter = ControlCenter.getInstance();
    private readonly id: string;

    public static processChannel(ws: Multiplexer, code: string): Mw | undefined {
        if (code !== ChannelCode.GTRC) {
            return;
        }
        return new HjhDeviceTracker(ws);
    }

    public static processRequest(ws: WS, params: RequestParameters): HjhDeviceTracker | undefined {
        if (params.action !== ACTION.GOOG_DEVICE_LIST) {
            return;
        }
        return new HjhDeviceTracker(ws);
    }

    constructor(ws: WS | Multiplexer) {
        super(ws);

        this.id = this.adt.getId();
        this.adt
            .init()
            .then(() => {
                this.adt.on('device', this.sendHjhDeviceMessage);
                this.buildAndSendMessage(this.adt.getHjhDevices());
            })
            .catch((error: Error) => {
                console.error(`[${HjhDeviceTracker.TAG}] Error: ${error.message}`);
            });
    }

    private sendHjhDeviceMessage = (device: GoogHjhDeviceDescriptor): void => {
        const data: HjhDeviceTrackerEvent<GoogHjhDeviceDescriptor> = {
            device,
            id: this.id,
            name: this.adt.getName(),
        };
        this.sendMessage({
            id: -1,
            type: 'device',
            data,
        });
    };

    private buildAndSendMessage = (list: GoogHjhDeviceDescriptor[]): void => {
        const data: HjhDeviceTrackerEventList<GoogHjhDeviceDescriptor> = {
            list,
            id: this.id,
            name: this.adt.getName(),
        };
        this.sendMessage({
            id: -1,
            type: 'devicelist',
            data,
        });
    };

    protected onSocketMessage(event: WS.MessageEvent): void {
        let command: ControlCenterCommand;
        try {
            command = ControlCenterCommand.fromJSON(event.data.toString());
        } catch (error: any) {
            console.error(`[${HjhDeviceTracker.TAG}], Received message: ${event.data}. Error: ${error?.message}`);
            return;
        }
        this.adt.runCommand(command).catch((e) => {
            console.error(`[${HjhDeviceTracker.TAG}], Received message: ${event.data}. Error: ${e.message}`);
        });
    }

    public release(): void {
        super.release();
        this.adt.off('device', this.sendHjhDeviceMessage);
    }
}
