import Capacitor
final class CourierViewController: CAPBridgeViewController {
    override func capacitorDidLoad() { bridge?.registerPluginInstance(FlightCourierPlugin()) }
}
