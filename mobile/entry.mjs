import {createCourierBridge} from '../flight-mobile.mjs';
const bridge=createCourierBridge(globalThis.Capacitor?.Plugins?.FlightCourier);
// No transfer UI or transport. Native diagnostics are available to owner-run qualification.
Object.defineProperty(globalThis,'huginnCourierLocal',{value:bridge,writable:false});

import {createFlightCourier} from "../flight-courier.mjs";
Object.defineProperty(globalThis,"huginnFlightCourier",{value:createFlightCourier(globalThis.Capacitor?.Plugins?.FlightCourier),writable:false});
