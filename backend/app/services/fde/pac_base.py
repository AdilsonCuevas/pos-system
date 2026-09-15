# FDE PAC Provider Base Class and Implementations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Dict, Any
from datetime import datetime
import hashlib
import base64

from app.models.fde import FDEDocument, FDENumbering
from app.models.pos import Sale
from app.models.user import User
from app.config import settings


@dataclass
class FDEResult:
    success: bool
    cufe: Optional[str] = None
    qr_code: Optional[str] = None
    xml_content: Optional[str] = None
    pdf_url: Optional[str] = None
    dian_response: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@dataclass
class FDEInvoice:
    """Data needed to generate UBL invoice."""
    sale: Sale
    customer: Optional[Dict[str, Any]] = None
    document_type: str = 'invoice'  # invoice, pos_ticket, credit_note, debit_note
    prefix: str = 'FAC'
    number: int = 1
    resolution: Optional[FDENumbering] = None


class PACProvider(ABC):
    """Abstract base class for PAC (Proveedor Autorizado de Certificación) providers."""
    
    @abstractmethod
    async def authorize_invoice(self, invoice: FDEInvoice) -> FDEResult:
        """Send invoice to DIAN for authorization."""
        pass
    
    @abstractmethod
    async def authorize_pos_ticket(self, ticket: FDEInvoice) -> FDEResult:
        """Send POS ticket to DIAN for authorization."""
        pass
    
    @abstractmethod
    async def cancel_document(self, cufe: str, reason: str) -> FDEResult:
        """Cancel authorized document (credit note)."""
        pass
    
    @abstractmethod
    async def check_status(self, cufe: str) -> FDEResult:
        """Check document status with DIAN."""
        pass
    
    def _generate_cufe(self, invoice: FDEInvoice) -> str:
        """Generate CUFE (Código Único de Factura Electrónica) - SHA384."""
        # CUFE = SHA384(
        #   NIT + DocumentType + Prefix + Number + 
        #   IssueDate + IssueTime + TotalAmount + 
        #   CustomerNIT + TechnicalKey
        # )
        parts = [
            settings.COMPANY_NIT,
            invoice.document_type,
            invoice.prefix,
            str(invoice.number).zfill(10),
            invoice.sale.created_at.strftime('%Y%m%d'),
            invoice.sale.created_at.strftime('%H%M%S'),
            str(int(invoice.sale.total * 100)),  # Amount in cents
            invoice.customer.get('tax_id', '') if invoice.customer else '',
            settings.FDE_TECHNICAL_KEY if hasattr(settings, 'FDE_TECHNICAL_KEY') else 'TEST_KEY',
        ]
        
        cufe_string = ''.join(parts)
        return hashlib.sha384(cufe_string.encode()).hexdigest().upper()
    
    def _build_qr_code(self, cufe: str) -> str:
        """Build DIAN validation QR code URL."""
        # Format: https://catalogo-vpfe.dian.gov.co/Document/Validate?cufe=<CUFE>
        base_url = "https://catalogo-vpfe.dian.gov.co/Document/Validate"
        if settings.FDE_TEST_MODE:
            base_url = "https://catalogo-vpfe-hab.dian.gov.co/Document/Validate"
        return f"{base_url}?cufe={cufe}"


class TecnoDataProvider(PACProvider):
    """TecnoData PAC Provider Implementation."""
    
    def __init__(self, api_key: str, nit: str, test_mode: bool = True):
        self.api_key = api_key
        self.nit = nit
        self.test_mode = test_mode
        self.base_url = "https://api.tecnodata.com.co/v1" if not test_mode else "https://api-hab.tecnodata.com.co/v1"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/xml",
            "Accept": "application/xml",
        }
    
    async def authorize_invoice(self, invoice: FDEInvoice) -> FDEResult:
        import httpx
        import xml.etree.ElementTree as ET
        
        try:
            ubl_xml = self._build_ubl_invoice(invoice)
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/factura",
                    content=ubl_xml,
                    headers=self.headers,
                )
                
                if response.status_code == 200:
                    return self._parse_response(response.text, ubl_xml)
                else:
                    return FDEResult(
                        success=False,
                        error=f"HTTP {response.status_code}: {response.text}",
                    )
        except Exception as e:
            return FDEResult(success=False, error=str(e))
    
    async def authorize_pos_ticket(self, ticket: FDEInvoice) -> FDEResult:
        import httpx
        
        try:
            ubl_xml = self._build_ubl_pos_ticket(ticket)
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/tiquete-pos",
                    content=ubl_xml,
                    headers=self.headers,
                )
                
                if response.status_code == 200:
                    return self._parse_response(response.text, ubl_xml)
                else:
                    return FDEResult(
                        success=False,
                        error=f"HTTP {response.status_code}: {response.text}",
                    )
        except Exception as e:
            return FDEResult(success=False, error=str(e))
    
    async def cancel_document(self, cufe: str, reason: str) -> FDEResult:
        import httpx
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/cancelar",
                    json={"cufe": cufe, "motivo": reason},
                    headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                )
                
                if response.status_code == 200:
                    return FDEResult(success=True, dian_response=response.json())
                else:
                    return FDEResult(success=False, error=f"HTTP {response.status_code}")
        except Exception as e:
            return FDEResult(success=False, error=str(e))
    
    async def check_status(self, cufe: str) -> FDEResult:
        import httpx
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/estado/{cufe}",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )
                
                if response.status_code == 200:
                    return FDEResult(success=True, dian_response=response.json())
                else:
                    return FDEResult(success=False, error=f"HTTP {response.status_code}")
        except Exception as e:
            return FDEResult(success=False, error=str(e))
    
    def _build_ubl_invoice(self, invoice: FDEInvoice) -> str:
        """Build UBL 2.1 Invoice XML for Colombia DIAN."""
        from lxml import etree
        
        # This is a simplified version - full implementation needs complete UBL structure
        # See: https://www.dian.gov.co/impuestos/factura-electronica/esquemas
        
        NSMAP = {
            None: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
            "cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
            "cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
            "ds": "http://www.w3.org/2000/09/xmldsig#",
            "xades": "http://uri.etsi.org/01903/v1.3.2#",
        }
        
        invoice_elem = etree.Element("{urn:oasis:names:specification:ubl:schema:xsd:Invoice-2}Invoice", nsmap=NSMAP)
        
        # Basic invoice info
        etree.SubElement(invoice_elem, "{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}UBLVersionID").text = "UBL 2.1"
        etree.SubElement(invoice_elem, "{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}CustomizationID").text = "1.0"
        etree.SubElement(invoice_elem, "{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}ProfileID").text = "DIAN 2.1"
        
        doc_id = etree.SubElement(invoice_elem, "{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}ID")
        doc_id.text = f"{invoice.prefix}{invoice.number:010d}"
        
        etree.SubElement(invoice_elem, "{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}IssueDate").text = invoice.sale.created_at.strftime('%Y-%m-%d')
        etree.SubElement(invoice_elem, "{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}IssueTime").text = invoice.sale.created_at.strftime('%H:%M:%S-05:00')
        
        # Document type: 01=Factura, 04=Tiquete POS
        type_code = etree.SubElement(invoice_elem, "{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}InvoiceTypeCode")
        type_code.set("listAgencyID", "6")
        type_code.set("listSchemeURI", "urn:dian:gov:co:facturaelectronica:DocumentTypeCode")
        type_code.text = "01" if invoice.document_type == 'invoice' else "04"
        
        etree.SubElement(invoice_elem, "{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}DocumentCurrencyCode").text = "COP"
        
        # ... Full UBL implementation would continue here
        # This is a placeholder for the complete XML structure
        
        return etree.tostring(invoice_elem, pretty_print=True, xml_declaration=True, encoding='UTF-8').decode()
    
    def _build_ubl_pos_ticket(self, ticket: FDEInvoice) -> str:
        """Build UBL 2.1 POS Ticket XML."""
        # Similar to invoice but with document type 04
        return self._build_ubl_invoice(ticket)  # Simplified
    
    def _parse_response(self, response_text: str, original_xml: str) -> FDEResult:
        """Parse PAC response and extract CUFE, QR, etc."""
        import xml.etree.ElementTree as ET
        
        try:
            root = ET.fromstring(response_text)
            
            # Extract status
            status = root.findtext('.//{*}Status') or root.findtext('.//{*}status')
            
            if status and status.lower() in ('authorized', 'aprobado', '0'):
                # Extract CUFE from response or generate
                cufe = root.findtext('.//{*}CUFE') or root.findtext('.//{*}cufe')
                if not cufe:
                    # Generate from original XML
                    pass
                
                qr = root.findtext('.//{*}QRCode') or root.findtext('.//{*}qrCode') or root.findtext('.//{*}QR')
                if not qr and cufe:
                    qr = self._build_qr_code(cufe)
                
                return FDEResult(
                    success=True,
                    cufe=cufe,
                    qr_code=qr,
                    xml_content=original_xml,
                    dian_response={'raw': response_text},
                )
            else:
                error_msg = root.findtext('.//{*}ErrorMessage') or root.findtext('.//{*}Message') or 'Error desconocido'
                return FDEResult(success=False, error=error_msg)
                
        except Exception as e:
            return FDEResult(success=False, error=f"Error parsing response: {e}")


class FacturacionElectronicaCoProvider(PACProvider):
    """Facturación Electrónica.co PAC Provider."""
    
    def __init__(self, api_key: str, nit: str, test_mode: bool = True):
        self.api_key = api_key
        self.nit = nit
        self.test_mode = test_mode
        self.base_url = "https://api.facturacionelectronica.co/v1" if not test_mode else "https://api-hab.facturacionelectronica.co/v1"
    
    async def authorize_invoice(self, invoice: FDEInvoice) -> FDEResult:
        # Implementation similar to TecnoData but with their API format
        return FDEResult(success=False, error="Not implemented")
    
    async def authorize_pos_ticket(self, ticket: FDEInvoice) -> FDEResult:
        return FDEResult(success=False, error="Not implemented")
    
    async def cancel_document(self, cufe: str, reason: str) -> FDEResult:
        return FDEResult(success=False, error="Not implemented")
    
    async def check_status(self, cufe: str) -> FDEResult:
        return FDEResult(success=False, error="Not implemented")


class SFEProvider(PACProvider):
    """S.F.E. (Sistemas de Facturación Electrónica) PAC Provider."""
    
    def __init__(self, api_key: str, nit: str, test_mode: bool = True):
        self.api_key = api_key
        self.nit = nit
        self.test_mode = test_mode
        self.base_url = "https://api.sfe.com.co/v1" if not test_mode else "https://api-hab.sfe.com.co/v1"
    
    async def authorize_invoice(self, invoice: FDEInvoice) -> FDEResult:
        return FDEResult(success=False, error="Not implemented")
    
    async def authorize_pos_ticket(self, ticket: FDEInvoice) -> FDEResult:
        return FDEResult(success=False, error="Not implemented")
    
    async def cancel_document(self, cufe: str, reason: str) -> FDEResult:
        return FDEResult(success=False, error="Not implemented")
    
    async def check_status(self, cufe: str) -> FDEResult:
        return FDEResult(success=False, error="Not implemented")


def get_pac_provider() -> PACProvider:
    """Factory function to get configured PAC provider."""
    provider_name = settings.FDE_PAC_PROVIDER.lower()
    
    if provider_name == 'tecnodata':
        return TecnoDataProvider(
            api_key=settings.TECNODATA_API_KEY,
            nit=settings.COMPANY_NIT,
            test_mode=settings.FDE_TEST_MODE,
        )
    elif provider_name == 'facturacion_electronica_co':
        return FacturacionElectronicaCoProvider(
            api_key=settings.FACTURACION_ELECTRONICA_CO_API_KEY,
            nit=settings.COMPANY_NIT,
            test_mode=settings.FDE_TEST_MODE,
        )
    elif provider_name == 'sfe':
        return SFEProvider(
            api_key=settings.SFE_API_KEY,
            nit=settings.COMPANY_NIT,
            test_mode=settings.FDE_TEST_MODE,
        )
    else:
        raise ValueError(f"Proveedor PAC no soportado: {provider_name}")