import {createCourierBridge} from '../flight-mobile.mjs';
const bridge=createCourierBridge(globalThis.Capacitor?.Plugins?.FlightCourier);
// Local diagnostics and Courier UI use native authority.
Object.defineProperty(globalThis,'huginnCourierLocal',{value:bridge,writable:false});

import {createFlightCourier} from "../flight-courier.mjs";
Object.defineProperty(globalThis,"huginnFlightCourier",{value:createFlightCourier(globalThis.Capacitor?.Plugins?.FlightCourier),writable:false});

import {mountCourierUI} from "../courier-ui.mjs";
mountCourierUI(document,globalThis.Capacitor?.Plugins?.FlightCourier,globalThis.huginnFlightCourier);
